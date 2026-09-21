import { createBrowserRouter, Outlet } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Launcher } from "./pages/Launcher";
import { Home } from "./pages/Home";
import { Overview } from "./pages/Overview";
import { Timeline } from "./pages/Timeline";
import { Journal } from "./pages/Journal";
import { Routine } from "./pages/Routine";
import { Clinic } from "./pages/Clinic";
import { Records } from "./pages/Records";
import { Appointments, Billing, Messages, Resources, Settings } from "./pages/Stubs";

function Portal() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Launcher /> },
  {
    element: <Portal />,
    children: [
      { path: "/home", element: <Home /> },
      { path: "/plan", element: <Overview /> },
      { path: "/plan/timeline", element: <Timeline /> },
      { path: "/plan/journal", element: <Journal /> },
      { path: "/plan/routine", element: <Routine /> },
      { path: "/clinic", element: <Clinic /> },
      { path: "/records", element: <Records /> },
      { path: "/appointments", element: <Appointments /> },
      { path: "/billing", element: <Billing /> },
      { path: "/settings", element: <Settings /> },
      { path: "/resources", element: <Resources /> },
      { path: "/messages", element: <Messages /> },
    ],
  },
]);
