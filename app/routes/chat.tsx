import { useEffect, useState, useRef } from 'react';
import { type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { db } from '~/db.server';
import { BroadcastChannel } from 'broadcast-channel';
import { Message } from 'postcss';

// Fetches the most recent 50 messages from the database when the page loads
export async function loader() {
  const messages = await db.execute({
    sql: 'SELECT * FROM messages ORDER BY created_at DESC LIMIT 50',
    args: []
  });
  
  return new Response(JSON.stringify({ messages: messages.rows }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

const messageChannel = new BroadcastChannel('chat-messages');

// Handles new message submissions and validates the input data
export async function action({ request }: LoaderFunctionArgs) {
  const formData = await request.formData();
  const content = formData.get('content');
  const username = formData.get('username');

  if (typeof content !== 'string' || typeof username !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await db.execute({
    sql: 'INSERT INTO messages (content, username) VALUES (?, ?) RETURNING *',
    args: [content, username]
  });

  const newMessage = result.rows[0];
  
  // Broadcast the new message to all clients
  messageChannel.postMessage({ type: 'message', message: newMessage });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// Main chat room component that handles the UI and real-time message updates
export default function ChatRoom() {
  const { messages: initialMessages } = useLoaderData<typeof loader>();
  const [messages, setMessages] = useState(initialMessages);
  const [username, setUsername] = useState('');
  const fetcher = useFetcher();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sets up the username from localStorage or generates a new one on component mount
  useEffect(() => {
    const storedUsername = localStorage.getItem('chat-username');
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      const newUsername = `User${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem('chat-username', newUsername);
      setUsername(newUsername);
    }
  }, []);

  // Set up SSE connection
  useEffect(() => {
    const eventSource = new EventSource('/chat/events');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        setMessages((prevMessages: Message[]) => [data.message, ...prevMessages]);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    fetcher.submit(form);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="h-96 overflow-y-auto mb-4 space-y-4">
          {messages.map((message: any) => (
            <div key={message.id} className="flex items-start gap-2">
              <div className="font-bold">{message.username}:</div>
              <div>{message.content}</div>
            </div>
          ))}
        </div>
        
        <fetcher.Form method="post" onSubmit={handleSubmit} className="flex gap-2">
          <input type="hidden" name="username" value={username} />
          <input
            ref={inputRef}
            type="text"
            name="content"
            className="flex-1 rounded-lg border p-2 dark:bg-gray-700 dark:border-gray-600"
            placeholder="Type your message..."
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Send
          </button>
        </fetcher.Form>
      </div>
    </div>
  );
}