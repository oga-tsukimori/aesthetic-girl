import * as React from 'react'
import { Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { api, type AdminUser, type AccessRole } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const roleLabel: Record<AccessRole, string> = {
  super_admin: 'Super admin',
  staff: 'Staff',
  guest: 'Guest',
}

function PasswordField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className="relative">
      <Input
        autoComplete="new-password"
        className="h-10 rounded-xl bg-white pr-10"
        minLength={8}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        type={visible ? 'text' : 'password'}
        value={value}
      />
      <button
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-black/35 transition-colors hover:text-[#89288F]"
        onClick={() => setVisible((current) => !current)}
        title={visible ? 'Hide password' : 'Show password'}
        type="button"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function UserManagement({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [passwordUser, setPasswordUser] = React.useState<string | null>(null)
  const [nextPassword, setNextPassword] = React.useState('')
  const [removeUser, setRemoveUser] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)

  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await api.adminUsers.list())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load users')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) void loadUsers()
  }, [open, loadUsers])

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const created = await api.adminUsers.create(email.trim(), password)
      setUsers((current) => [...current, created].sort((a, b) => a.email.localeCompare(b.email)))
      setEmail('')
      setPassword('')
      setMessage(`${created.email} now has guest access.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the account')
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (id: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await api.adminUsers.changePassword(id, nextPassword)
      const user = users.find((entry) => entry.id === id)
      setPasswordUser(null)
      setNextPassword('')
      setMessage(`Password updated for ${user?.email ?? 'the account'}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change the password')
    } finally {
      setBusy(false)
    }
  }

  const deleteUser = async (id: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const user = users.find((entry) => entry.id === id)
      await api.adminUsers.remove(id)
      setUsers((current) => current.filter((entry) => entry.id !== id))
      setRemoveUser(null)
      setMessage(`${user?.email ?? 'The account'} was removed.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove the account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setPasswordUser(null)
          setRemoveUser(null)
          setError(null)
          setMessage(null)
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[26px] border-none p-0 sm:max-w-[720px]">
        <DialogHeader className="border-b border-black/[.06] px-6 py-5 pr-14 text-left sm:px-7">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#89288F]/10 text-[#89288F]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-[20px] font-extrabold tracking-tight">User management</DialogTitle>
              <DialogDescription className="mt-1 text-[12px] font-semibold text-black/40">
                Create guest accounts, change passwords, or remove access.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-5 pb-6 sm:px-7">
          {(error || message) && (
            <div className={`rounded-xl px-3.5 py-2.5 text-[12px] font-semibold ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
              {error || message}
            </div>
          )}

          <form className="rounded-2xl border border-[#89288F]/10 bg-[#F8F4FA] p-4" onSubmit={createUser}>
            <div className="mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#89288F]" />
              <h3 className="text-[13px] font-extrabold">Create a guest account</h3>
            </div>
            <p className="mb-3 text-[11.5px] font-semibold leading-relaxed text-black/40">
              Every new account is view-only. Share the temporary password securely with the user.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                autoComplete="email"
                className="h-10 rounded-xl bg-white"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                required
                type="email"
                value={email}
              />
              <PasswordField value={password} onChange={setPassword} placeholder="Temporary password" />
              <Button className="h-10 rounded-xl px-4 font-bold" disabled={busy} type="submit">
                {busy ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
                Create
              </Button>
            </div>
          </form>

          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-[13px] font-extrabold">People with access</h3>
              <span className="text-[11px] font-bold text-black/35">{users.length} accounts</span>
            </div>

            {loading ? (
              <div className="grid min-h-32 place-items-center rounded-2xl border border-black/[.06]">
                <LoaderCircle className="h-5 w-5 animate-spin text-[#89288F]" />
              </div>
            ) : (
              <div className="divide-y divide-black/[.06] overflow-hidden rounded-2xl border border-black/[.06]">
                {users.map((user) => (
                  <div className="bg-white p-3.5 sm:p-4" key={user.id}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[.035] text-black/45">
                        {user.role === 'super_admin' ? <ShieldCheck className="h-4 w-4 text-[#89288F]" /> : <Users className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[12.5px] font-extrabold">{user.email}</p>
                          {user.isCurrent && <span className="text-[10px] font-bold text-[#89288F]">You</span>}
                        </div>
                        <span className="mt-1 inline-flex rounded-full bg-black/[.045] px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-black/45">
                          {roleLabel[user.role]}
                        </span>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          aria-label={`Change password for ${user.email}`}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-black/[.04] text-black/45 transition-colors hover:bg-[#89288F]/10 hover:text-[#89288F]"
                          onClick={() => {
                            setPasswordUser(user.id)
                            setRemoveUser(null)
                            setNextPassword('')
                          }}
                          title="Change password"
                          type="button"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        {!user.isCurrent && (
                          <button
                            aria-label={`Remove ${user.email}`}
                            className="grid h-9 w-9 place-items-center rounded-xl bg-black/[.04] text-black/45 transition-colors hover:bg-red-50 hover:text-red-600"
                            onClick={() => {
                              setRemoveUser(user.id)
                              setPasswordUser(null)
                            }}
                            title="Remove account"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {passwordUser === user.id && (
                      <form
                        className="mt-3 grid gap-2 rounded-xl bg-black/[.025] p-3 sm:grid-cols-[1fr_auto_auto]"
                        onSubmit={(event) => {
                          event.preventDefault()
                          void changePassword(user.id)
                        }}
                      >
                        <PasswordField value={nextPassword} onChange={setNextPassword} placeholder="New password" />
                        <Button className="h-10 rounded-xl font-bold" disabled={busy} type="submit">Save password</Button>
                        <Button className="h-10 rounded-xl font-bold" onClick={() => setPasswordUser(null)} type="button" variant="ghost">Cancel</Button>
                      </form>
                    )}

                    {removeUser === user.id && (
                      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-red-50 p-3 sm:flex-row sm:items-center">
                        <p className="flex-1 text-[11.5px] font-semibold text-red-700">Remove this account and revoke its access?</p>
                        <div className="flex gap-2">
                          <Button className="h-9 rounded-xl font-bold" onClick={() => setRemoveUser(null)} type="button" variant="ghost">Cancel</Button>
                          <Button className="h-9 rounded-xl bg-red-600 font-bold hover:bg-red-700" disabled={busy} onClick={() => void deleteUser(user.id)} type="button">Remove</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {!users.length && !loading && (
                  <p className="p-6 text-center text-[12px] font-semibold text-black/40">No accounts found.</p>
                )}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
