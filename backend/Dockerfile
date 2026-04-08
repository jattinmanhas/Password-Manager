FROM golang:1.24-alpine AS builder

WORKDIR /app

# Download dependencies first for layering efficiency
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/api ./cmd/api

FROM alpine:3.20
RUN adduser -D -u 1000 appuser
USER appuser
WORKDIR /home/appuser

COPY --from=builder /bin/api /usr/local/bin/api

# Port is usually defined by env var, but EXPOSE is good practice
EXPOSE 8080

CMD ["/usr/local/bin/api"]
