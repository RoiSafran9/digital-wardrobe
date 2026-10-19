"""The App Review demo account: one account that signs in with a password instead of an email code.

Apple's Beta App Review can't read a sign-in email, so it gets this account's email and password
(entered privately in App Store Connect → TestFlight → Test Information; never in the repo). In the
app, holding the "Sign in with email" title for a second opens password sign-in.

  create   makes the account (email already confirmed) or, if it exists, unblocks it; either way it
           gets a new random password, printed once here. Run it again after a reviewer deletes
           the account, or to change the password.
  disable  blocks sign-in (and session refresh) and replaces the password with one nobody knows.

Only accounts made here have a password; everyone else's account signs in by code only.
Dry run by default.

Usage (from the repo root, with SUPABASE_URL and SUPABASE_SECRET_KEY set, e.g. in .env):
  python -m scripts.demo_account create            # show what would happen
  python -m scripts.demo_account create --apply    # do it and print the password
  python -m scripts.demo_account disable --apply   # after review
"""
import argparse
import secrets
import sys

DEFAULT_EMAIL = "review@kipscloset.com"
# No look-alike characters (0/O, 1/l/I): a reviewer may type it by hand.
ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_password() -> str:
    """Four groups of five, e.g. `aB3xk-…`: about 116 bits, out of reach of Supabase's rate-limited sign-in."""
    return "-".join("".join(secrets.choice(ALPHABET) for _ in range(5)) for _ in range(4))


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["create", "disable"])
    parser.add_argument("--email", default=DEFAULT_EMAIL, help=f"the demo account's email (default {DEFAULT_EMAIL})")
    parser.add_argument("--apply", action="store_true", help="actually change the account; without it this is a dry run")
    return parser


def _default_store():
    import os
    from dotenv import load_dotenv
    from api.auth import load_settings
    from api.store import SupabaseStore
    load_dotenv()
    return SupabaseStore(load_settings({**os.environ, "WARDROBE_AUTH": "on"}))


def main(argv=None, store=None) -> int:
    args = _parser().parse_args(argv)
    email = args.email.strip().lower()
    store = store or _default_store()
    profile = store.find_user_by_email(email)
    user_id = profile["id"] if profile else None

    if args.command == "disable":
        if not user_id:
            print(f"No account for {email}: nothing to disable.")
            return 0
        print(f"Account   {email} {user_id}")
        if not args.apply:
            print("Dry run: would block sign-in and replace the password. Re-run with --apply.")
            return 0
        store.update_auth_user(user_id, new_password(), banned=True)
        print("Disabled: sign-in is blocked and the old password no longer works.")
        return 0

    print(f"Account   {email} {user_id or '(new)'}")
    if not args.apply:
        action = "unblock it and set a new password" if user_id else "create it with a new password"
        print(f"Dry run: would {action}. Re-run with --apply.")
        return 0
    password = new_password()
    if user_id:
        store.update_auth_user(user_id, password, banned=False)
    else:
        user_id = store.create_auth_user(email, password)
    print(f"Ready     {user_id}")
    print(f"Password  {password}")
    print("Enter these in App Store Connect only. This password isn't stored anywhere else; run create again for a new one.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
