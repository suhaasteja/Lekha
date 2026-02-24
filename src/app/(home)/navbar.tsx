import Link from "next/link";
import Image from "next/image";
import { SearchInput } from "./search-input";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  OrganizationSwitcher,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  return (
    <nav className="flex items-center justify-between h-full w-full">
      <div className="flex gap-3 items-center shrink-0 pr-6">
        <Link href="/">
          <Image src={"/logo.svg"} alt="Logo" width={36} height={36} />
        </Link>
        <div className="flex flex-col leading-tight">
          <span className="text-xs uppercase tracking-[0.22em] text-slate-400">Workspace</span>
          <h3 className="text-xl font-semibold text-slate-900">Lekha</h3>
        </div>
      </div>
      <SearchInput />
      <div className="flex gap-3 items-center pl-6">
        <SignedIn>
          <OrganizationSwitcher
            afterCreateOrganizationUrl="/"
            afterLeaveOrganizationUrl="/"
            afterSelectOrganizationUrl="/"
            afterSelectPersonalUrl="/"
          />
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button size="sm">Sign in</Button>
          </SignInButton>
        </SignedOut>
      </div>
    </nav>
  );
};
