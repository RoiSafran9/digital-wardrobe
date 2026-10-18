"""Admin grant tool: dry run by default, explicit everything, idempotent by key."""
import pytest
from api.store import MemoryStore
from scripts.grant_credits import main

A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ARGS = ["--email", "friend@example.com", "--amount", "5", "--reason", "F&F pilot", "--key", "ff-friend-1", "--by", "owner"]


@pytest.fixture
def store():
    s = MemoryStore()
    s.emails["friend@example.com"] = A
    return s


def test_dry_run_shows_the_grant_and_writes_nothing(store, capsys):
    assert main(ARGS, store=store) == 0
    out = capsys.readouterr().out
    assert A in out and "0 → 5" in out and "Dry run" in out
    assert store.ledger == [] and store.credits(A) == {"balance": 0, "held": 0}


def test_apply_grants_and_records_who_and_why(store, capsys):
    assert main(ARGS + ["--apply"], store=store) == 0
    assert store.credits(A) == {"balance": 5, "held": 0}
    entry = store.ledger[0]
    assert (entry["kind"], entry["amount"], entry["note"], entry["granted_by"]) == ("grant", 5, "F&F pilot", "owner")
    assert "Granted 5" in capsys.readouterr().out


def test_rerunning_the_same_key_grants_nothing_more(store, capsys):
    main(ARGS + ["--apply"], store=store)
    capsys.readouterr()
    assert main(ARGS + ["--apply"], store=store) == 0
    assert store.credits(A)["balance"] == 5 and len(store.ledger) == 1
    assert "already granted" in capsys.readouterr().out


def test_dry_run_of_a_used_key_says_so(store, capsys):
    main(ARGS + ["--apply"], store=store)
    capsys.readouterr()
    main(ARGS, store=store)
    assert "already granted" in capsys.readouterr().out


def test_a_used_key_with_another_amount_is_refused(store, capsys):
    main(ARGS + ["--apply"], store=store)
    changed = [a if a != "5" else "50" for a in ARGS]
    assert main(changed + ["--apply"], store=store) == 1
    assert store.credits(A)["balance"] == 5
    assert "different grant" in capsys.readouterr().err


def test_an_unknown_email_is_refused(store, capsys):
    args = ["--email", "nobody@example.com"] + ARGS[2:]
    assert main(args + ["--apply"], store=store) == 1
    assert store.ledger == [] and "no account" in capsys.readouterr().err


def test_a_user_id_works_instead_of_an_email(store):
    args = ["--user-id", A] + ARGS[2:]
    assert main(args + ["--apply"], store=store) == 0
    assert store.credits(A)["balance"] == 5


def test_a_disabled_account_is_refused(store, capsys):
    store.disabled.add(A)
    assert main(ARGS + ["--apply"], store=store) == 1
    assert store.ledger == [] and "disabled" in capsys.readouterr().err


@pytest.mark.parametrize("amount", ["0", "-3", "1.5", "lots"])
def test_the_amount_must_be_a_positive_whole_number(store, amount):
    args = list(ARGS)
    args[args.index("--amount") + 1] = amount
    with pytest.raises(SystemExit) as e:
        main(args, store=store)
    assert e.value.code == 2


@pytest.mark.parametrize("missing", ["--amount", "--reason", "--key", "--by"])
def test_every_field_is_required(store, missing):
    args = list(ARGS)
    i = args.index(missing)
    del args[i:i + 2]
    with pytest.raises(SystemExit) as e:
        main(args, store=store)
    assert e.value.code == 2
