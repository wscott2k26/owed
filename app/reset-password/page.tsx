import Link from "next/link";
import ResetPasswordForm from "../../components/ResetPasswordForm";
export default function ResetPassword({searchParams}:{searchParams:{token?:string}}){return <main className="mx-auto max-w-md px-5 py-16"><Link href="/" className="text-2xl font-bold">Owed</Link><h1 className="mt-10 text-3xl font-bold">Choose a new password</h1><ResetPasswordForm token={searchParams.token||""}/></main>}
