// app/routes.ts
import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  // 1. The Home/Index page (where your ConnectionManager sits)
  index("routes/home.tsx"),

  // 2. The Host Server Dashboard route
  route("/host", "routes/host/dashboard.tsx"),

  // 3. The Regular Client View route
  route("/connect", "routes/client/view.tsx"),

] satisfies RouteConfig;