import React from "react";
import ReactDOM from "react-dom/client";
import Home from "./pages/Home.tsx";
import GPT from "./pages/GPT.tsx";
import { NextUIProvider } from "@nextui-org/react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import "./index.css";

const router = createHashRouter([
  {
    path: "/",
    element: (
      <main className="dark text-foreground bg-background">
        <Home />
      </main>
    ),
  },
  {
    path: "/gpt",
    element: <GPT />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NextUIProvider>
      <RouterProvider router={router} />
    </NextUIProvider>
  </React.StrictMode>
);
