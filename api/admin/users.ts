import { withSupabase } from '@supabase/server'

export const config = { runtime: 'edge' }

type MemberRow = {
  user_id: string
  role: 'super_admin' | 'staff' | 'guest'
  created_at: string
}

type AuthUserRow = {
  id: string
  email?: string
  created_at: string
}

type AuthResult<T> = Promise<{
  data: T
  error: { message: string } | null
}>

type ServerAuth = {
  admin: {
    listUsers: (options: { page: number; perPage: number }) => AuthResult<{ users: AuthUserRow[] }>
    createUser: (attributes: { email: string; password: string; email_confirm: boolean }) => AuthResult<{ user: AuthUserRow | null }>
    updateUserById: (id: string, attributes: { password: string }) => AuthResult<{ user: AuthUserRow | null }>
    deleteUser: (id: string) => AuthResult<{ user: AuthUserRow | null }>
  }
}

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export default withSupabase({ auth: 'user', cors: 'disabled' }, async (request, context) => {
  const currentUserId = context.userClaims?.id
  if (!currentUserId) return json({ error: 'Please sign in again' }, 401)

  try {
    const { data: membership, error: membershipError } = await context.supabaseAdmin
      .from('shop_members')
      .select('owner_id, role')
      .eq('user_id', currentUserId)
      .single()
    if (membershipError || membership?.role !== 'super_admin') {
      throw new HttpError(403, 'Only the super admin can manage users')
    }

    const ownerId = String(membership.owner_id)
    const serverAuth = context.supabaseAdmin.auth as unknown as ServerAuth

    if (request.method === 'GET') {
      const { data: members, error: membersError } = await context.supabaseAdmin
        .from('shop_members')
        .select('user_id, role, created_at')
        .eq('owner_id', ownerId)
      if (membersError) throw membersError

      const { data: authUsers, error: usersError } = await serverAuth.admin.listUsers({ page: 1, perPage: 1000 })
      if (usersError) throw usersError
      const usersById = new Map(authUsers.users.map((user) => [user.id, user]))
      const users = ((members ?? []) as MemberRow[])
        .map((member) => {
          const user = usersById.get(member.user_id)
          return {
            id: member.user_id,
            email: user?.email ?? 'Unknown email',
            role: member.role,
            createdAt: user?.created_at ?? member.created_at,
            isCurrent: member.user_id === currentUserId,
          }
        })
        .sort((a, b) => {
          if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
          return a.email.localeCompare(b.email)
        })
      return json({ users })
    }

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      throw new HttpError(400, 'Invalid request body')
    }

    if (request.method === 'POST') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      if (!email) throw new HttpError(400, 'Enter an email address')
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters')

      const { data: created, error: createError } = await serverAuth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createError || !created.user) {
        const status = createError?.message.toLowerCase().includes('already') ? 409 : 400
        throw new HttpError(status, createError?.message || 'Could not create the account')
      }

      const { error: memberError } = await context.supabaseAdmin.from('shop_members').upsert({
        user_id: created.user.id,
        owner_id: ownerId,
        role: 'guest',
      })
      if (memberError) {
        await serverAuth.admin.deleteUser(created.user.id)
        throw memberError
      }

      return json({
        user: {
          id: created.user.id,
          email: created.user.email ?? email,
          role: 'guest',
          createdAt: created.user.created_at,
          isCurrent: false,
        },
      }, 201)
    }

    const id = String(body.id ?? '')
    if (!id) throw new HttpError(400, 'Choose an account')
    const { data: target, error: targetError } = await context.supabaseAdmin
      .from('shop_members')
      .select('user_id')
      .eq('user_id', id)
      .eq('owner_id', ownerId)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) throw new HttpError(404, 'Account not found')

    if (request.method === 'PATCH') {
      const password = String(body.password ?? '')
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters')
      const { error } = await serverAuth.admin.updateUserById(id, { password })
      if (error) throw error
      return json({ ok: true })
    }

    if (request.method === 'DELETE') {
      if (id === currentUserId) throw new HttpError(400, 'You cannot remove your own account')
      const { error } = await serverAuth.admin.deleteUser(id)
      if (error) throw error
      return json({ ok: true })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        Allow: 'GET, POST, PATCH, DELETE',
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    })
  } catch (cause) {
    const status = cause instanceof HttpError ? cause.status : 500
    const message = cause instanceof Error ? cause.message : 'Could not manage users'
    return json({ error: message }, status)
  }
})
