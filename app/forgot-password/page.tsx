import Link from "next/link";
import ForgotPasswordForm from "../../components/ForgotPasswordForm";
export default function ForgotPassword(){return <main className="mx-auto max-w-md px-5 py-16"><Link href="/" className="text-2xl font-bold">Owed</Link><h1 className="mt-10 text-3xl font-bold">Reset password</h1><p className="mt-2 text-sm text-muted">Enter your account email. Reset links expire in one hour.</p><ForgotPasswordForm/><p className="mt-6 text-center text-sm"><Link href="/login" className="text-amber">Back to sign in</Link></p></main>}
