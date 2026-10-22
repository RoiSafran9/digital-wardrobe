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


def test_new_fields_round_trip(tmp_path):
    logger = RunLogger(str(tmp_path / "log.jsonl"))
    logger.log(stage="stage4_generate", model="gemini-3.1-flash-image", prompt_version="v5", latency_ms=900.0,
               status="ok", cost_usd=0.07, input_tokens=1200, output_tokens=1290, images_out=1, fallback=True)
    [entry] = logger.read_all()
    assert (entry.input_tokens, entry.output_tokens, entry.images_out, entry.fallback) == (1200, 1290, 1, True)
    assert entry.cost_usd == 0.07 and entry.ts is not None


def test_old_lines_without_new_fields_still_read(tmp_path):
    path = tmp_path / "log.jsonl"
    path.write_text('{"stage": "s", "model": "m", "prompt_version": "v1", "latency_ms": 1.0, "status": "ok"}\n')
    [entry] = RunLogger(str(path)).read_all()
    assert entry.input_tokens is None and entry.fallback is False and entry.error_class is None
