"""Give an account promotional AI Credits (F&F). Admin only: runs on the server with its secret key.

Every grant needs the recipient, a whole number of credits, a reason (the user sees it in their
activity), an operation key and who is granting. The key makes the grant happen once: running the
same command again changes nothing. There is no default amount and no "everyone" option.
Dry run by default.

Usage (from the repo root, with SUPABASE_URL and SUPABASE_SECRET_KEY set, e.g. in .env):
  python -m scripts.grant_credits --email friend@example.com --amount <N> --reason "F&F pilot" \\
      --key ff-pilot-friend-1 --by <admin name>            # show what would happen
  python -m scripts.grant_credits ... --apply             # grant it
"""
import argparse
import sys
from api.credits import CreditError


def _positive_whole(value: str) -> int:
    if not value.isdigit() or int(value) <= 0:
        raise argparse.ArgumentTypeError("must be a positive whole number of credits")
    return int(value)


def _text(value: str) -> str:
    if not value.strip():
        raise argparse.ArgumentTypeError("must not be empty")
    return value.strip()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    who = parser.add_mutually_exclusive_group(required=True)
    who.add_argument("--email", type=_text, help="the account's sign-in email")
    who.add_argument("--user-id", type=_text, help="the account's user id")
    parser.add_argument("--amount", type=_positive_whole, required=True, help="credits to grant")
    parser.add_argument("--reason", type=_text, required=True, help="why; shown to the user")
    parser.add_argument("--key", type=_text, required=True, help="unique name for this grant, e.g. ff-pilot-<name>-1")
    parser.add_argument("--by", type=_text, required=True, help="who is granting (kept for audit, hidden from the user)")
    parser.add_argument("--apply", action="store_true", help="actually grant; without it this is a dry run")
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
    store = store or _default_store()

    if args.email:
        profile = store.find_user_by_email(args.email)
        user_id = profile["id"] if profile else None
    else:
        user_id = args.user_id if store.user_exists(args.user_id) else None
    if not user_id:
        print(f"Refused: no account for {args.email or args.user_id}.", file=sys.stderr)
        return 1

    wallet = store.credits(user_id)
    done = store.find_grant(user_id, args.key)
    print(f"Account   {args.email or ''} {user_id}".rstrip())
    print(f"Grant     {args.amount} credits — {args.reason!r} (key {args.key}, by {args.by})")
    if done and done["amount"] == args.amount:
        print(f"Key {args.key} was already granted on {done['created_at']}: nothing to do.")
        return 0
    print(f"Balance   {wallet['balance']} → {wallet['balance'] + args.amount} (held {wallet['held']})")
    if not args.apply:
        print("Dry run: nothing was granted. Re-run with --apply to grant it.")
        return 0

    try:
        entry = store.credit_grant(user_id, args.amount, args.key, args.reason, args.by)
    except CreditError as e:
        print(f"Refused ({e.code}): {e}", file=sys.stderr)
        return 1
    print(f"Granted {entry['amount']} credits. Balance is now {entry['balance_after']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
