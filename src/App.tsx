import { useCredentials } from './hooks/useCredentials';
import { CredentialsPanel } from './components/CredentialsPanel';
import { JobForm } from './components/JobForm';
import './App.css';

export default function App() {
  const { credentials, setCredentials } = useCredentials();

  return (
    <div className="app">
      <header className="app-header">
        <h1>CTS Job Submission</h1>
        <a
          href="https://github.com/kbase/cdm-task-service"
          target="_blank"
          rel="noreferrer"
          className="header-link"
        >
          CDM Task Service ↗
        </a>
      </header>
      <main>
        <CredentialsPanel credentials={credentials} onChange={setCredentials} />
        <JobForm credentials={credentials} />
      </main>
    </div>
  );
}
