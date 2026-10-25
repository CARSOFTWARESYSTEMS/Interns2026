import { describe, expect, it } from 'vitest'
import { countryCodeFor, locationFromHeaders, resolveLocation } from './location.js'

const headers = (h: Record<string, string>) => new Headers(h)

describe('approximate location from Vercel headers', () => {
  it('names the country and state, and decodes the city', () => {
    expect(locationFromHeaders(headers({
      'x-vercel-ip-country': 'IN', 'x-vercel-ip-country-region': 'KA', 'x-vercel-ip-city': 'Bengaluru', 'x-vercel-ip-timezone': 'Asia/Kolkata',
    }))).toEqual({ country: 'India', countryCode: 'IN', stateOrRegion: 'Karnataka', city: 'Bengaluru', timezone: 'Asia/Kolkata' })
    expect(locationFromHeaders(headers({ 'x-vercel-ip-country': 'DE', 'x-vercel-ip-city': 'M%C3%BCnchen', 'x-vercel-ip-country-region': 'BY' })))
      .toMatchObject({ country: 'Germany', city: 'München', stateOrRegion: 'BY' })
  })

  it('knows both the old and new ISO codes for Indian states', () => {
    for (const [code, name] of [['TS', 'Telangana'], ['TG', 'Telangana'], ['OR', 'Odisha'], ['OD', 'Odisha'], ['UT', 'Uttarakhand'], ['UK', 'Uttarakhand']]) {
      expect(locationFromHeaders(headers({ 'x-vercel-ip-country': 'IN', 'x-vercel-ip-country-region': code }))!.stateOrRegion).toBe(name)
    }
  })

  it('is null without a usable country', () => {
    expect(locationFromHeaders(headers({}))).toBeNull()
    expect(locationFromHeaders(headers({ 'x-vercel-ip-country': 'XX' }))).toBeNull()
    expect(locationFromHeaders(headers({ 'x-vercel-ip-country': '<script>' }))).toBeNull()
  })

  it('drops malformed parts instead of storing them', () => {
    expect(locationFromHeaders(headers({
      'x-vercel-ip-country': 'in', 'x-vercel-ip-country-region': 'KARNATAKA', 'x-vercel-ip-city': '%E0%A4%A', 'x-vercel-ip-timezone': '../../etc',
    }))).toEqual({ country: 'India', countryCode: 'IN', stateOrRegion: '', city: '%E0%A4%A', timezone: '' })
  })

  it('never reads coordinates or postal code', () => {
    const loc = locationFromHeaders(headers({
      'x-vercel-ip-country': 'IN', 'x-vercel-ip-latitude': '12.97', 'x-vercel-ip-longitude': '77.59', 'x-vercel-ip-postal-code': '560001',
    }))
    expect(JSON.stringify(loc)).not.toMatch(/12\.97|77\.59|560001/)
  })
})

describe('location priority', () => {
  const approx = { country: 'India', countryCode: 'IN', stateOrRegion: 'Tamil Nadu', city: 'Chennai', timezone: 'Asia/Kolkata' }

  it("uses the user's profile over the approximate location", () => {
    expect(resolveLocation({ country: 'India', stateOrRegion: 'Karnataka', city: 'Mangaluru' }, approx)).toEqual({
      source: 'user_profile',
      location: { country: 'India', countryCode: 'IN', stateOrRegion: 'Karnataka', city: 'Mangaluru', timezone: 'Asia/Kolkata' },
    })
  })

  it("keeps the network's time zone only when it agrees on the country", () => {
    expect(resolveLocation({ country: 'Singapore' }, approx)!.location).toMatchObject({ countryCode: 'SG', timezone: '', stateOrRegion: '' })
  })

  it('falls back to the approximate location, then to none', () => {
    expect(resolveLocation({ country: '  ', city: 'Pune' }, approx)).toEqual({ source: 'ip_approximate', location: approx })
    expect(resolveLocation(null, approx)).toEqual({ source: 'ip_approximate', location: approx })
    expect(resolveLocation(null, null)).toBeNull()
    expect(resolveLocation({ country: 42 }, null)).toBeNull()
  })

  it('reads country names the way people type them', () => {
    expect(countryCodeFor('india')).toBe('IN')
    expect(countryCodeFor('United States')).toBe('US')
    expect(countryCodeFor('USA')).toBe('US')
    expect(countryCodeFor('in')).toBe('IN')
    expect(countryCodeFor('Atlantis')).toBe('')
  })
})
