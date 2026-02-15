from typing import Any, Dict, List, Tuple


class NormalizationParseError(ValueError):
    pass


class TenderNormalizer:
    @staticmethod
    def _first(raw: Dict[str, Any], keys: List[str], default=None):
        for key in keys:
            if key in raw and raw[key] not in (None, ""):
                return raw[key]
        return default

    @staticmethod
    def _as_int(value):
        if value is None:
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str):
            cleaned = "".join(ch for ch in value if ch.isdigit())
            return int(cleaned) if cleaned else None
        return None

    def parse(self, raw_payload: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        if not isinstance(raw_payload, dict):
            raise NormalizationParseError("raw_payload must be a dict")

        title = self._first(raw_payload, ["title", "tender_title", "bid_name", "name"])
        agency = self._first(raw_payload, ["agency", "agency_name", "organization", "issuer"])

        if not title:
            raise NormalizationParseError("title is required for canonical normalization")

        deadline = self._first(raw_payload, ["deadline", "closing_at", "due_date", "bid_deadline"])
        region = self._first(raw_payload, ["region", "location", "area"])
        category = self._first(raw_payload, ["category", "industry", "biz_category"])

        budget_min = self._as_int(self._first(raw_payload, ["budget_min", "min_budget", "budgetLow"]))
        budget_max = self._as_int(self._first(raw_payload, ["budget_max", "max_budget", "budgetHigh", "budget"]))

        raw_urls = self._first(raw_payload, ["urls", "links"], default=[])
        if isinstance(raw_urls, str):
            urls = [raw_urls]
        elif isinstance(raw_urls, list):
            urls = [u for u in raw_urls if isinstance(u, str)]
        else:
            urls = []

        canonical = {
            "title": title,
            "agency": agency,
            "deadline": deadline,
            "budget": {
                "min": budget_min,
                "max": budget_max,
                "currency": self._first(raw_payload, ["currency"], default="KRW"),
            },
            "region": region,
            "category": category,
            "urls": urls,
        }

        attachments = []
        raw_attachments = self._first(raw_payload, ["attachments", "files"], default=[])
        if isinstance(raw_attachments, list):
            for item in raw_attachments:
                if not isinstance(item, dict):
                    continue
                attachments.append(
                    {
                        "attachment_type": item.get("type", "document"),
                        "filename": item.get("filename") or item.get("name") or "unknown",
                        "storage_path": item.get("storage_path"),
                        "mime_type": item.get("mime_type") or item.get("mime"),
                        "byte_size": self._as_int(item.get("byte_size") or item.get("size")),
                        "content_hash": item.get("content_hash"),
                        "metadata": {"url": item.get("url")},
                    }
                )

        return canonical, attachments
