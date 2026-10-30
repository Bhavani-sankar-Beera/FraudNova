"""Bulk transaction upload, validation, prediction, and export helpers."""

from datetime import datetime
from io import BytesIO, StringIO
import os
import re
import uuid

import pandas as pd


REQUIRED_COLUMNS = {
    "transaction_id",
    "customer_id",
    "amount_inr",
    "account_type",
    "transaction_type",
    "merchant_category",
    "payment_method",
    "transaction_direction",
    "location",
    "device_type",
    "network_type",
    "transaction_frequency",
    "average_spending_inr",
    "previous_transaction_amount_inr",
    "distance_from_previous_location_km",
    "account_balance_inr",
    "credit_score",
}

NUMERIC_COLUMNS = {
    "amount_inr",
    "transaction_frequency",
    "average_spending_inr",
    "previous_transaction_amount_inr",
    "distance_from_previous_location_km",
    "account_balance_inr",
    "credit_score",
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "amount_vs_average_ratio",
    "amount_change_from_previous_ratio",
}

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_RECORDS = 10000


def read_upload(file_storage):
    """Read a supported upload into a dataframe without persisting the file."""
    filename = file_storage.filename or ""
    extension = os.path.splitext(filename)[1].lower()
    if extension not in {".csv", ".xlsx", ".xls"}:
        raise ValueError("Only .csv, .xlsx, and .xls files are supported.")

    content = file_storage.read()
    if len(content) > MAX_FILE_BYTES:
        raise ValueError("The uploaded file must be 10 MB or smaller.")
    if not content:
        raise ValueError("The uploaded file is empty.")

    try:
        if extension == ".csv":
            frame = pd.read_csv(StringIO(content.decode("utf-8-sig")))
        else:
            frame = pd.read_excel(BytesIO(content))
    except Exception as exc:
        raise ValueError(f"Unable to read the uploaded file: {exc}") from exc

    frame.columns = [
        str(column).strip().lower().replace(" ", "_") for column in frame.columns
    ]
    if len(frame) > MAX_RECORDS:
        raise ValueError(f"Uploads are limited to {MAX_RECORDS} records.")
    return frame, filename, len(content)


def validate_frame(frame):
    """Return row-level validation errors and the rows safe for prediction."""
    missing_columns = sorted(REQUIRED_COLUMNS - set(frame.columns))
    errors = []
    valid_rows = []
    seen_ids = set()

    for index, (_, row) in enumerate(frame.iterrows(), start=2):
        row_errors = []
        transaction_id = str(row.get("transaction_id", "")).strip()
        if not transaction_id or transaction_id.lower() == "nan":
            row_errors.append("transaction_id is required")
        elif transaction_id in seen_ids:
            row_errors.append("duplicate transaction_id")
        seen_ids.add(transaction_id)

        for column in sorted(REQUIRED_COLUMNS):
            if column in frame.columns and pd.isna(row.get(column)):
                row_errors.append(f"{column} is required")

        for column in sorted(NUMERIC_COLUMNS & set(frame.columns)):
            value = row.get(column)
            if not pd.isna(value):
                try:
                    number = float(value)
                    if column in {"amount_inr", "average_spending_inr",
                                  "previous_transaction_amount_inr",
                                  "account_balance_inr"} and number < 0:
                        row_errors.append(f"{column} cannot be negative")
                except (TypeError, ValueError):
                    row_errors.append(f"{column} must be numeric")

        if "transaction_date" in frame.columns and not pd.isna(row.get("transaction_date")):
            if pd.isna(pd.to_datetime(row["transaction_date"], errors="coerce")):
                row_errors.append("transaction_date has an invalid date format")
        if "transaction_time" in frame.columns and not pd.isna(row.get("transaction_time")):
            parsed_time = pd.to_datetime(str(row["transaction_time"]), errors="coerce")
            if pd.isna(parsed_time):
                row_errors.append("transaction_time has an invalid time format")

        record = {
            key: (
                None
                if pd.isna(value)
                else value.isoformat()
                if isinstance(value, (pd.Timestamp, datetime))
                else value.item()
                if hasattr(value, "item")
                else value
            )
            for key, value in row.to_dict().items()
        }
        if row_errors:
            errors.append({"row": index, "transaction_id": transaction_id, "errors": row_errors})
        else:
            valid_rows.append(record)

    return {
        "missing_columns": missing_columns,
        "errors": errors,
        "valid_rows": valid_rows,
        "duplicate_records": sum(
            1 for error in errors if "duplicate transaction_id" in error["errors"]
        ),
    }


def preview_rows(frame, limit=10):
    """Convert a dataframe preview into JSON-safe values."""
    preview = frame.head(limit).where(pd.notna(frame.head(limit)), None)
    rows = []
    for row in preview.to_dict(orient="records"):
        rows.append({
            key: value.isoformat() if isinstance(value, (pd.Timestamp, datetime)) else value.item()
            if hasattr(value, "item") else value
            for key, value in row.items()
        })
    return rows


def csv_bytes(rows):
    frame = pd.DataFrame(rows)
    return frame.to_csv(index=False).encode("utf-8")


def excel_bytes(rows):
    output = BytesIO()
    pd.DataFrame(rows).to_excel(output, index=False, engine="openpyxl")
    return output.getvalue()


def template_bytes():
    columns = sorted(REQUIRED_COLUMNS | {
        "transaction_date", "transaction_time", "hour_of_day", "day_of_week",
        "is_weekend", "amount_vs_average_ratio",
        "amount_change_from_previous_ratio",
    })
    return excel_bytes([{column: "" for column in columns}])


def new_batch_id():
    return uuid.uuid4().hex
