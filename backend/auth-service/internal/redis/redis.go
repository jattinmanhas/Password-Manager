package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	*redis.Client
	ctx context.Context
}

func New(addr, password string, db int) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx := context.Background()

	// Test connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return &Client{
		Client: rdb,
		ctx:    ctx,
	}, nil
}

func (c *Client) Set(key string, value interface{}, expiration time.Duration) error {
	return c.Client.Set(c.ctx, key, value, expiration).Err()
}

func (c *Client) Get(key string) (string, error) {
	return c.Client.Get(c.ctx, key).Result()
}

func (c *Client) Exists(key string) (bool, error) {
	count, err := c.Client.Exists(c.ctx, key).Result()
	return count > 0, err
}

func (c *Client) Delete(key string) error {
	return c.Client.Del(c.ctx, key).Err()
}

func (c *Client) Increment(key string) (int64, error) {
	return c.Client.Incr(c.ctx, key).Result()
}

func (c *Client) SetNX(key string, value interface{}, expiration time.Duration) (bool, error) {
	return c.Client.SetNX(c.ctx, key, value, expiration).Result()
}

func (c *Client) Expire(key string, expiration time.Duration) error {
	return c.Client.Expire(c.ctx, key, expiration).Err()
}

func (c *Client) Close() error {
	return c.Client.Close()
}

