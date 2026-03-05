import json, sys
result = {"demucs": False, "cuda": False, "mps": False}
try:
    import demucs
    result["demucs"] = True
except ImportError:
    pass
try:
    import torch
    result["cuda"] = torch.cuda.is_available()
    result["mps"] = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
except ImportError:
    pass
print(json.dumps(result))
