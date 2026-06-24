import json
import logging

import azure.functions as func

from model_provider import get_provider

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
_provider = None


def provider():
    global _provider
    if _provider is None:
        _provider = get_provider()
    return _provider


@app.route(route="health", methods=["GET"])
def health(_: func.HttpRequest) -> func.HttpResponse:
    active = provider().__class__.__name__
    return func.HttpResponse(json.dumps({"status":"ok","provider":active}, ensure_ascii=False), mimetype="application/json")


@app.route(route="recommend", methods=["POST"])
def recommend(req: func.HttpRequest) -> func.HttpResponse:
    try:
        payload = req.get_json()
        result = provider().recommend(payload.get("answers", {}))
        return func.HttpResponse(json.dumps(result, ensure_ascii=False), mimetype="application/json", status_code=200)
    except ValueError as error:
        return func.HttpResponse(json.dumps({"error":str(error)}, ensure_ascii=False), mimetype="application/json", status_code=400)
    except Exception as error:
        logging.exception("Recommendation failed")
        return func.HttpResponse(json.dumps({"error":"추천 분석을 완료하지 못했습니다.","detail":str(error)}, ensure_ascii=False), mimetype="application/json", status_code=500)
