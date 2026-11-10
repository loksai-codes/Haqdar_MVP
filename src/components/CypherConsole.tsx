import React, { useState } from 'react';
import { Play, Database, Terminal, RefreshCw, Copy, Check, Table, Code2 } from 'lucide-react';

export const CypherConsole: React.FC = () => {
  const [query, setQuery] = useState(
    `MATCH (s:Scheme) OPTIONAL MATCH (s)-[:ELIGIBLE_IF]->(c:Criterion) RETURN s.name AS scheme, s.benefit AS benefit, s.official_url AS url, collect(properties(c)) AS criteria`
  );
  const [results, setResults] = useState<any[] | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [copied, setCopied] = useState(false);

  const sampleQueries = [
    {
      title: 'Schemes & Criteria',
      cypher: `MATCH (s:Scheme) OPTIONAL MATCH (s)-[:ELIGIBLE_IF]->(c:Criterion) RETURN s.name AS scheme, s.benefit AS benefit, s.official_url AS url, collect(properties(c)) AS criteria`
    },
    {
      title: 'Required Documents',
      cypher: `MATCH (s:Scheme)-[:REQUIRES]->(d:Document) RETURN s.name AS scheme, collect(d.name) AS required_documents`
    },
    {
      title: 'Prerequisite Chains',
      cypher: `MATCH (doc:Document)-[:REQUIRES]->(prereq:Document) RETURN doc.name AS missing_document, collect(prereq.name) AS prerequisites`
    },
    {
      title: 'Issuing Offices',
      cypher: `MATCH (d:Document)-[:ISSUED_BY]->(o:Office) RETURN d.name AS document, o.name AS office, o.portal_url AS portal_url`
    },
    {
      title: 'Scheme Conflicts',
      cypher: `MATCH (s1:Scheme)-[:CONFLICTS_WITH]-(s2:Scheme) RETURN s1.name AS scheme_a, s2.name AS scheme_b`
    }
  ];

  const handleExecute = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/graph/cypher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setResults(null);
      } else {
        setResults(data.data || []);
        setExecutionTime(data.executionTimeMs || 0);
        setSource(data.source || 'falkordb_cloud');
      }
    } catch (err: any) {
      setError(err.message || 'Execution failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJSON = () => {
    if (!results) return;
    navigator.clipboard.writeText(JSON.stringify(results, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tableColumns = results && results.length > 0 ? Object.keys(results[0]) : [];

  return (
    <div className="space-y-6">
      {/* Console Header */}
      <div className="border-b border-white/[0.06] pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>openCypher Live Graph Console</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Execute raw openCypher pattern queries against the FalkorDB welfare knowledge graph with real-time tabular output.
        </p>
      </div>

      {/* Preset Queries */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mr-1">
          <Terminal className="w-3.5 h-3.5" />
          <span>Presets:</span>
        </span>
        {sampleQueries.map((sample, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuery(sample.cypher);
            }}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-900/60 border border-white/[0.08] text-slate-300 hover:text-white hover:border-emerald-500/40 transition-colors cursor-pointer"
          >
            {sample.title}
          </button>
        ))}
      </div>

      {/* Query Editor Box */}
      <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl overflow-hidden shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-slate-950/60">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>FalkorDB Cypher Engine</span>
          </div>

          <button
            onClick={handleExecute}
            disabled={loading || !query.trim()}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Cypher Query</span>
              </>
            )}
          </button>
        </div>

        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          rows={4}
          className="w-full bg-slate-950 p-4 font-mono text-xs text-emerald-300 focus:outline-none resize-y selection:bg-emerald-500/30"
          placeholder="MATCH (s:Scheme)-[:REQUIRES]->(d:Document) RETURN s.name, d.name LIMIT 20"
        />
      </div>

      {/* Results */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 font-mono">
          Query Error: {error}
        </div>
      )}

      {results && (
        <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-slate-950/80">
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              <span className="text-white font-semibold">{results.length} records</span>
              <span>·</span>
              <span className="text-emerald-400 tabular-nums font-semibold">{executionTime} ms</span>
              <span>·</span>
              <span className="text-slate-500 capitalize">{source?.replace('_', ' ')}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-900 border border-white/[0.08] rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                    viewMode === 'table' ? 'bg-white/[0.1] text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  <Table className="w-3 h-3" />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => setViewMode('json')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                    viewMode === 'json' ? 'bg-white/[0.1] text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  <Code2 className="w-3 h-3" />
                  <span>JSON</span>
                </button>
              </div>

              <button
                onClick={handleCopyJSON}
                className="p-1.5 rounded-lg bg-slate-950 border border-white/[0.08] text-slate-400 hover:text-white"
                title="Copy JSON"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {viewMode === 'table' ? (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-slate-950/40 text-slate-400 font-mono">
                    {tableColumns.map(col => (
                      <th key={col} className="px-4 py-2.5 font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono">
                  {results.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/[0.02] text-slate-200">
                      {tableColumns.map(col => {
                        const val = row[col];
                        return (
                          <td key={col} className="px-4 py-2 text-xs">
                            {typeof val === 'object' ? (
                              <pre className="text-[10px] text-amber-300 max-w-xs truncate">
                                {JSON.stringify(val)}
                              </pre>
                            ) : (
                              String(val ?? 'null')
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="p-4 bg-slate-950 text-xs font-mono text-emerald-300 overflow-x-auto max-h-96 whitespace-pre">
              {JSON.stringify(results, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Schema Reference */}
      <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/[0.06] text-xs space-y-3">
        <h3 className="font-bold text-slate-200 font-mono uppercase tracking-wider">
          FalkorDB Welfare Knowledge Graph Schema
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-400">
          <div>
            <span className="text-slate-300 font-semibold">Node Labels:</span>
            <ul className="mt-1 space-y-1 font-mono text-[11px] text-slate-400">
              <li>(:Citizen &#123;age, gender, marital_status, occupation, annual_income, state&#125;)</li>
              <li>(:Scheme &#123;name, benefit, level, official_url, last_verified&#125;)</li>
              <li>(:Document &#123;name, validity&#125;)</li>
              <li>(:Criterion &#123;type, operator, value&#125;)</li>
              <li>(:Office &#123;name, type, portal_url&#125;)</li>
            </ul>
          </div>
          <div>
            <span className="text-slate-300 font-semibold">Edge Types:</span>
            <ul className="mt-1 space-y-1 font-mono text-[11px] text-slate-400">
              <li>(:Scheme)-[:REQUIRES]-&gt;(:Document)</li>
              <li>(:Document)-[:REQUIRES]-&gt;(:Document)</li>
              <li>(:Document)-[:ISSUED_BY]-&gt;(:Office)</li>
              <li>(:Scheme)-[:ELIGIBLE_IF]-&gt;(:Criterion)</li>
              <li>(:Scheme)-[:CONFLICTS_WITH]-&gt;(:Scheme)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
