// app/routes.ts
import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  // 1. The Home/Index page (where your ConnectionManager sits)
  index("routes/home.tsx"),

  // 2. The Host Server Dashboard route
  route("/host", "routes/host/dashboard.tsx"),
  route("/host/round2", "routes/host/Round2/host_index.tsx"),
  route("/host/round4", "routes/host/Round4/host_index.tsx"),

  // 3. The Regular Client View route
  route("/play", "routes/client/view.tsx"),
  route("/play/round2", "routes/client/Round2/client_index.tsx"),
  route("/play/round4", "routes/client/Round4/client_index.tsx"),

] satisfies RouteConfig;