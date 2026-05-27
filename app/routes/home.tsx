import type { Route } from "./+types/home";
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

  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome to the App</h1>
      
      {/* Interactive buttons component */}
      <ConnectionManager />

      <hr />
      
      <h3>Live Feed ({notifications.length})</h3>
      {/* Notification lists go here */}
    </div>
  );
}