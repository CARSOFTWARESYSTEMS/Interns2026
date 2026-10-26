import { describe, it, expect, vi, afterEach } from 'vitest'
import { CentralSessionError, finishSignOut } from './centralSession'

const EV_LOGIN = 'login.autonomous.ev.engineer'

function serverAnswers(status: number, body: unknown) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => { vi.unstubAllGlobals() })

describe('finishSignOut (/signout on a login host)', () => {
  it("sends the ticket to end-session, ends that user's Firebase sign-in, and only then gives the page to return to", async () => {
    const fetch = serverAnswers(200, { uid: 'u1', returnTo: 'https://aerospace.ev.engineer/aerospace?bye=1' })
    let release!: () => void
    const signOutFirebaseUser = vi.fn(() => new Promise<void>(resolve => { release = resolve }))
    let settled = false
    const done = finishSignOut('the-ticket', signOutFirebaseUser, EV_LOGIN).then(url => { settled = true; return url })

    await vi.waitFor(() => expect(signOutFirebaseUser).toHaveBeenCalledWith('u1'))
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/auth/end-session')
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
    expect(JSON.parse(String(init?.body))).toEqual({ ticket: 'the-ticket' })

    await new Promise(r => setTimeout(r, 0))
    expect(settled).toBe(false) // no redirect while Firebase is still signing out
    release()
    expect(await done).toBe('https://aerospace.ev.engineer/aerospace?bye=1')
  })

  it('ends no Firebase sign-in when the server names no user (a ticket too old to act on)', async () => {
    serverAnswers(200, { uid: null, returnTo: 'https://www.ev.engineer/' })
    const signOutFirebaseUser = vi.fn()
    expect(await finishSignOut('old', signOutFirebaseUser, EV_LOGIN)).toBe('https://www.ev.engineer/')
    expect(signOutFirebaseUser).not.toHaveBeenCalled()
  })

  it('fails without touching Firebase when the server refuses or cannot be reached', async () => {
    const signOutFirebaseUser = vi.fn()
    serverAnswers(400, { error: 'invalid_logout' })
    await expect(finishSignOut('forged', signOutFirebaseUser, EV_LOGIN)).rejects.toEqual(new CentralSessionError('invalid_logout'))
    serverAnswers(403, { error: 'forbidden_origin' })
    await expect(finishSignOut('t', signOutFirebaseUser, EV_LOGIN)).rejects.toEqual(new CentralSessionError('forbidden_origin'))
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(finishSignOut('t', signOutFirebaseUser, EV_LOGIN)).rejects.toEqual(new CentralSessionError('network'))
    expect(signOutFirebaseUser).not.toHaveBeenCalled()
  })

  it.each([
    'https://evil.example/',
    'https://www.gamyaa.in/',             // another login host's site
    'http://aerospace.ev.engineer/',
    'javascript:alert(1)',
    '/relative',
  ])('never leaves for %j', async returnTo => {
    serverAnswers(200, { uid: 'u1', returnTo })
    const signOutFirebaseUser = vi.fn()
    await expect(finishSignOut('t', signOutFirebaseUser, EV_LOGIN)).rejects.toEqual(new CentralSessionError('invalid_logout'))
    expect(signOutFirebaseUser).not.toHaveBeenCalled()
  })
})
