import { useSourceConfiguration } from "../sources/useSourceConfiguration";
import { SourceConfigurationStatus } from "../sources/SourceConfigurationStatus";
import { BlueprintConnection } from "../blueprint/BlueprintConnection";

export function App() {
  const configuration = useSourceConfiguration();
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <span className="brand-mark" aria-hidden="true">
          J
        </span>
        <span>Journey Builder</span>
      </header>
      <main id="main-content" tabIndex={-1}>
        <p className="eyebrow">Form workflows</p>
        <h1>Journey Builder</h1>
        <p className="intro">Connect your forms through prefilled data.</p>
        <section className="workspace" aria-labelledby="workspace-heading">
          <span className="workspace-icon" aria-hidden="true">
            ↳
          </span>
          <h2 id="workspace-heading">Your form workspace</h2>
          <BlueprintConnection
            selections={
              configuration.state.status === "success" ? configuration.state.selections : undefined
            }
          />
          <SourceConfigurationStatus configuration={configuration} />
        </section>
      </main>
    </>
  );
}
