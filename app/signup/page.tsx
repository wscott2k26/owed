import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "../../components/AuthForm";
import { getCurrentUser } from "../../lib/auth/session";
export default async function SignupPage(){ if(await getCurrentUser()) redirect("/dashboard"); return <main className="mx-auto max-w-md px-5 py-16"><Link href="/" className="text-2xl font-bold">Owed</Link><h1 className="mt-10 text-3xl font-bold">Start getting paid.</h1><p className="mt-2 text-sm text-muted">Create the account, import the invoices, let the machine do the nudging.</p><AuthForm mode="signup"/><p className="mt-6 text-center text-sm text-muted">Already have an account? <Link className="text-amber" href="/login">Sign in</Link></p></main> }
