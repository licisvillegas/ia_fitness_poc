from bson import ObjectId

def normalize_user_id(value):
    """Return user_id as string or None."""
    if value is None:
        return None
    return str(value).strip()

def maybe_object_id(value):
    """Return ObjectId when value looks like a valid ObjectId, else None."""
    if value is None:
        return None
    value = str(value).strip()
    if ObjectId.is_valid(value):
        return ObjectId(value)
    return None
