import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import Toaster from "./components/Toaster";
import Home from "./pages/Home";
import NovaColeta from "./pages/NovaColeta";
import Painel from "./pages/Painel";
import Animais from "./pages/Animais";
import Pontos from "./pages/Pontos";
import Ajustes from "./pages/Ajustes";
import Modelo from "./pages/Modelo";
import Passagem from "./pages/Passagem";

function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/";
}

export default function App() {
  const [route, setRoute] = useState<string>(currentRoute());

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  let page = <Home />;
  if (route === "/coletar") page = <NovaColeta />;
  else if (route === "/painel") page = <Painel />;
  else if (route === "/animais") page = <Animais />;
  else if (route === "/pontos") page = <Pontos />;
  else if (route === "/ajustes") page = <Ajustes />;
  else if (route === "/modelo") page = <Modelo />;
  else if (route === "/passagem") page = <Passagem />;

  return (
    <Layout route={route}>
      {page}
      <Toaster />
    </Layout>
  );
}