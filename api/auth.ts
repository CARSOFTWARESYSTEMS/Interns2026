// Vercel Function for every /api/auth/* request (vercel.json routes them here
// with ?__route=<rest of the path>). All logic lives in server/auth.
import { handleAuthRequest } from '../server/auth/vercel.js'

export default {
  fetch: handleAuthRequest,
}
