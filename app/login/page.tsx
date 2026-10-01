import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "../../components/AuthForm";
import { getCurrentUser } from "../../lib/auth/session";
export default async function LoginPage(){ if(await getCurrentUser()) redirect("/dashboard"); return <main className="mx-auto max-w-md px-5 py-16"><Link href="/" className="text-2xl font-bold">Owed</Link><h1 className="mt-10 text-3xl font-bold">Welcome back.</h1><p className="mt-2 text-sm text-muted">Your receivables aren’t going to chase themselves.</p><AuthForm mode="login"/><p className="mt-4 text-center text-sm"><Link className="text-amber" href="/forgot-password">Forgot password?</Link></p><p className="mt-6 text-center text-sm text-muted">New here? <Link className="text-amber" href="/signup">Create an account</Link></p></main> }
