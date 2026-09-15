import { Outlet, createBrowserRouter, Navigate } from "react-router-dom";
import { DeckSwitcher } from "./components/DeckSwitcher";
import { Launcher } from "./pages/Launcher";
import { LuminaPortal } from "./portals/patient/lumina/Lumina";
import { VivaraPortal } from "./portals/patient/vivara/Vivara";
import { RadiantPortal } from "./portals/patient/radiant/Radiant";
import { PastelShell } from "./portals/clinic/pastel/Shell";
import { PastelOverview } from "./portals/clinic/pastel/Overview";
import { PastelDiary } from "./portals/clinic/pastel/Diary";
import { PastelPatients } from "./portals/clinic/pastel/Patients";
import { PastelRecord } from "./portals/clinic/pastel/Record";
import { PastelPerformance } from "./portals/clinic/pastel/Performance";
import { PastelSimple } from "./portals/clinic/pastel/Simple";
import { JourneyShell } from "./portals/clinic/journey/Shell";
import { JourneyOverview } from "./portals/clinic/journey/Overview";
import { JourneyPatient } from "./portals/clinic/journey/Patient";
import { JourneyRetention } from "./portals/clinic/journey/Retention";
import { JourneySimple } from "./portals/clinic/journey/Simple";
import { AdvancedShell } from "./portals/clinic/advanced/Shell";
import { AdvancedOverview } from "./portals/clinic/advanced/Overview";
import { AdvancedDiary } from "./portals/clinic/advanced/Diary";
import { AdvancedPatient } from "./portals/clinic/advanced/Patient";
import { AdvancedBoard } from "./portals/clinic/advanced/Board";
import { AdvancedSimple } from "./portals/clinic/advanced/Simple";

function Frame() {
  return (
    <>
      <Outlet />
      <DeckSwitcher />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Frame />,
    children: [
      { path: "/", element: <Launcher /> },
      { path: "/patient", element: <Navigate to="/patient/lumina" replace /> },
      { path: "/patient/lumina/:page?", element: <LuminaPortal /> },
      { path: "/patient/vivara/:tab?", element: <VivaraPortal /> },
      { path: "/patient/radiant/:page?", element: <RadiantPortal /> },
      {
        path: "/clinic",
        children: [
          { index: true, element: <Navigate to="/clinic/pastel/overview" replace /> },
          {
            path: "pastel",
            element: <PastelShell />,
            children: [
              { index: true, element: <Navigate to="/clinic/pastel/overview" replace /> },
              { path: "overview", element: <PastelOverview /> },
              { path: "diary", element: <PastelDiary /> },
              { path: "patients", element: <PastelPatients /> },
              { path: "patients/:id", element: <PastelRecord /> },
              { path: "performance", element: <PastelPerformance /> },
              { path: "retention", element: <PastelSimple page="retention" /> },
            ],
          },
          {
            path: "journey",
            element: <JourneyShell />,
            children: [
              { index: true, element: <Navigate to="/clinic/journey/overview" replace /> },
              { path: "overview", element: <JourneyOverview /> },
              { path: "patients/:id", element: <JourneyPatient /> },
              { path: "retention", element: <JourneyRetention /> },
              { path: "diary", element: <JourneySimple page="diary" /> },
              { path: "patients", element: <JourneySimple page="patients" /> },
              { path: "board", element: <JourneySimple page="board" /> },
              { path: "performance", element: <JourneySimple page="performance" /> },
            ],
          },
          {
            path: "advanced",
            element: <AdvancedShell />,
            children: [
              { index: true, element: <Navigate to="/clinic/advanced/overview" replace /> },
              { path: "overview", element: <AdvancedOverview /> },
              { path: "diary", element: <AdvancedDiary /> },
              { path: "patients/:id", element: <AdvancedPatient /> },
              { path: "board", element: <AdvancedBoard /> },
              { path: "patients", element: <AdvancedSimple page="patients" /> },
              { path: "reports", element: <AdvancedSimple page="reports" /> },
              { path: "messages", element: <AdvancedSimple page="messages" /> },
            ],
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
