import asyncio
import os
import sys
import tempfile
import time
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.run_log import RunLogger
from cli import build_providers
from pipeline.orchestrator import run_photo

st.set_page_config(page_title="Wardrobe Pipeline Test Harness", layout="wide")
st.title("Wardrobe Pipeline — Test Harness")

uploaded_files = st.file_uploader("Upload photo(s)", type=["jpg", "jpeg", "png"],
                                   accept_multiple_files=True)

if st.button("Run pipeline", disabled=not uploaded_files):
    run_id = time.strftime("%Y%m%d-%H%M%S")
    run_dir = os.path.join("runs", run_id)
    os.makedirs(run_dir, exist_ok=True)
    logger = RunLogger(os.path.join(run_dir, "run_log.jsonl"))

    try:
        providers = build_providers(logger)
    except RuntimeError as e:
        st.error(f"Setup error: {e}")
        st.stop()

    for uploaded in uploaded_files:
        st.header(uploaded.name)
        with tempfile.NamedTemporaryFile(suffix=os.path.splitext(uploaded.name)[1], delete=False) as tmp:
            tmp.write(uploaded.getvalue())
            photo_path = tmp.name

        photo_name = os.path.splitext(uploaded.name)[0]
        output_dir = os.path.join(run_dir, photo_name)
        result = asyncio.run(run_photo(photo_path, output_dir, providers, logger))

        st.write(f"Quality: **{result['quality'].status}**"
                 + (f" ({result['quality'].reason})" if result['quality'].reason else ""))

        if not result["items"]:
            st.info("No items detected (or excluded by scope rules).")

        for i, outcome in enumerate(result["items"]):
            with st.expander(f"Item {i} — tier: {outcome['result'].tier}", expanded=True):
                cols = st.columns(2)
                item_dir = os.path.join(output_dir, f"item_{i}")
                crop_path = os.path.join(item_dir, "crop.png")
                gen_path = os.path.join(item_dir, "generated.png")
                if os.path.exists(crop_path):
                    cols[0].image(crop_path, caption="Crop (source of truth)")
                if os.path.exists(gen_path):
                    cols[1].image(gen_path, caption="Generated")
                st.json(outcome["facts"].model_dump())
                if outcome["verification"]:
                    st.json(outcome["verification"].model_dump())
                st.write(f"Reason: {outcome['result'].reason}")
                if outcome["result"].retake_instruction:
                    st.warning(f"Retake: {outcome['result'].retake_instruction}")

        if result["failed"]:
            st.error(f"Failed items: {', '.join(result['failed'])}")

    st.divider()
    st.subheader("Run log")
    entries = logger.read_all()
    st.dataframe([e.model_dump() for e in entries])
