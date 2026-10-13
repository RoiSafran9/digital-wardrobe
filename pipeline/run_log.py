import json
from pipeline.types import RunLogEntry


class RunLogger:
    def __init__(self, path: str):
        self.path = path

    def log(self, *, stage: str, model: str, prompt_version: str,
             latency_ms: float, status: str, cost_usd: float | None = None,
             error: str | None = None) -> None:
        entry = RunLogEntry(
            stage=stage, model=model, prompt_version=prompt_version,
            latency_ms=latency_ms, cost_usd=cost_usd, status=status, error=error,
        )
        with open(self.path, "a") as f:
            f.write(entry.model_dump_json() + "\n")

    def read_all(self) -> list[RunLogEntry]:
        entries = []
        try:
            with open(self.path) as f:
                for line in f:
                    if line.strip():
                        entries.append(RunLogEntry.model_validate(json.loads(line)))
        except FileNotFoundError:
            pass
        return entries
