-- Enable Realtime for the messages table so inserts/updates are broadcast to subscribed clients.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;