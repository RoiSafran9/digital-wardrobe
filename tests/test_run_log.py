from pipeline.run_log import RunLogger


def test_log_and_read_back(tmp_path):
    log_path = tmp_path / "run_log.jsonl"
    logger = RunLogger(str(log_path))
    logger.log(stage="stage0", model="opencv", prompt_version="v1",
                latency_ms=12.5, status="ok")
    logger.log(stage="stage1", model="gemini-2.5-flash", prompt_version="v1",
                latency_ms=300.0, status="error", error="timeout")
    entries = logger.read_all()
    assert len(entries) == 2
    assert entries[0].stage == "stage0" and entries[0].status == "ok"
    assert entries[1].error == "timeout"
