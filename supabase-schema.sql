-- Run this in your Supabase SQL Editor

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  tier TEXT DEFAULT 'mortal',
  daily_chat_used INTEGER DEFAULT 0,
  daily_audio_used INTEGER DEFAULT 0,
  narrations_remaining INTEGER DEFAULT 0,
  chats_remaining INTEGER DEFAULT 0,
  last_reset_date TEXT DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  email TEXT,
  username TEXT,
  reference TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payment_codes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  device_id TEXT,
  email TEXT,
  tier TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
