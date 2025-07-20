FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip wheel -r requirements.txt --wheel-dir /wheels

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN pip install --no-index --find-links=/wheels /wheels/*.whl
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "warning"]