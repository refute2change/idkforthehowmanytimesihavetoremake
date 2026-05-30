import type { Route } from "./+types/home";
import { useState } from "react";
import { Welcome } from "../welcome/welcome";
import { useSocket } from "../components/SocketContext";
import { ConnectionManager } from "~/components/ConnectionManager";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  const { notifications } = useSocket();
  const [selectedRole, setSelectedRole] = useState<'host-server' | 'regular-client'>('regular-client');
  const [clientName, setClientName] = useState('');

  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome to the App</h1>
      
      {/* Interactive buttons component */}
      <ConnectionManager
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        clientName={clientName}
      />

      {selectedRole === 'regular-client' && (
        <div style={{ marginTop: '16px', maxWidth: '400px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            Client Name
          </label>
          <input
            type="text"
            placeholder="Enter your name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>
      )}

      <hr style={{ margin: '24px 0' }} />
      
      <h3>Live Feed ({notifications.length})</h3>
      {/* Notification lists go here */}
    </div>
  );
}