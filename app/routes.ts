// app/routes.ts
import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  // 1. The Home/Index page (where your ConnectionManager sits)
  index("routes/home.tsx"),

  // 2. The Host Server Dashboard route
  route("/host", "routes/host/dashboard.tsx"),
  route("/host/round2", "routes/host/Round2/index.tsx"),

  // 3. The Regular Client View route
  route("/play", "routes/client/view.tsx"),
  route("/play/round2", "routes/client/Round2/index.tsx"),

] satisfies RouteConfig;