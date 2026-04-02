FROM golang:1.26-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod ./
COPY . .
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /stocktake-api ./cmd/api

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /stocktake-api .
EXPOSE 8080
CMD ["./stocktake-api"]
