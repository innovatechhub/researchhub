import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiBookOpen,
  FiShield,
  FiSearch,
  FiUsers,
  FiDatabase,
  FiLock,
  FiArrowRight,
  FiInfo,
  FiMapPin,
  FiMail
} from 'react-icons/fi';
import { site } from '../../../core/config/site';
import { useAuth } from '../../../app/providers/AuthProvider';
import { listPublicResearch } from '../../../infrastructure/repositories/publicRepository';

const features = [
  [FiDatabase, 'Store', 'Safely store and organize research outputs in one secure system.'],
  [FiShield, 'Preserve', 'Preserve research documents for future reference and integrity.'],
  [FiSearch, 'Retrieve', 'Discover research and find the knowledge you need, all in one place.'],
  [
    FiUsers,
    'For Everyone',
    'Connecting students, teachers, and researchers through shared knowledge.'
  ]
];
function ResearchCard({ entry }) {
  const { user, role } = useAuth();
  const destination = `/${role || 'researcher'}/library?research=${entry.research_id}`;
  return (
    <article className="public-research-card">
      <div className="research-card-body">
        <div className="document-icon">
          <FiBookOpen />
          <FiLock className="document-lock" />
        </div>
        <div>
          <span className="eyebrow">
            {entry.category} · {entry.year}
          </span>
          <h3>{entry.title}</h3>
          <p className="research-authors">{entry.authors.join(', ')}</p>
          <p className="research-excerpt">{entry.abstract_excerpt}</p>
        </div>
      </div>
      <Link
        className="research-card-link"
        to={user ? destination : `/login?research=${entry.research_id}`}
      >
        <FiLock />
        {user ? 'View research details' : 'Sign in to view research details'}
        <FiArrowRight />
      </Link>
    </article>
  );
}
export function ResearchPreviewList({ browse = false }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [state, setState] = useState({ records: [], count: 0, loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);
  const limit = browse ? 9 : 3;
  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    listPublicResearch({ search: query, page, limit })
      .then((data) => {
        if (active) setState({ ...data, loading: false, error: '' });
      })
      .catch((error) => {
        if (active) setState({ records: [], count: 0, loading: false, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [query, page, limit, attempt]);
  return (
    <>
      {browse && (
        <form
          className="catalogue-search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setQuery(search);
          }}
        >
          <label htmlFor="catalogue-query">Search by research title</label>
          <div>
            <FiSearch />
            <input
              id="catalogue-query"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="What would you like to discover?"
            />
            <button className="button button-navy">Search</button>
          </div>
        </form>
      )}
      {state.loading ? (
        <div className="preview-state" role="status">
          Loading research…
        </div>
      ) : state.error ? (
        <div className="preview-state" role="alert">
          <p>{state.error}</p>
          <button className="button button-outline" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : state.records.length ? (
        <div className="public-research-grid">
          {state.records.map((entry) => (
            <ResearchCard key={entry.research_id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="preview-state">
          <FiBookOpen />
          <h3>{query ? 'No matching research' : 'A growing collection of knowledge'}</h3>
          <p>
            {query
              ? 'Try a different title or keyword.'
              : 'Approved research previews will appear here as the school makes them available.'}
          </p>
        </div>
      )}
      {browse && state.count > limit && (
        <div className="pagination">
          <button
            className="button button-outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {Math.ceil(state.count / limit)}
          </span>
          <button
            className="button button-outline"
            disabled={(page + 1) * limit >= state.count}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
export function HomePage() {
  return (
    <>
      <section
        className={`home-hero ${site.heroImage ? 'has-photo' : ''}`}
        style={site.heroImage ? { '--hero-image': `url("${site.heroImage}")` } : undefined}
      >
        <div className="site-container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">KNOWLEDGE TODAY. POSSIBILITIES TOMORROW.</p>
            <h1>
              Welcome to
              <br />
              ResearchHub <span>BNHS</span>
            </h1>
            <div className="green-rule" />
            <p className="hero-description">
              A digital repository that stores, preserves, and retrieves research outputs of Barbaza
              National High School.
            </p>
            <div className="hero-actions">
              <Link className="button button-navy" to="/browse">
                <FiBookOpen />
                Browse Research
              </Link>
              <Link className="button button-outline" to="/about">
                <FiInfo />
                About the System
              </Link>
            </div>
          </div>
          {!site.heroImage && (
            <div className="hero-brand-art" aria-hidden="true">
              <div className="hero-orbit" />
              <img src={site.logo} alt="" />
              <span className="hero-art-label">A home for every discovery.</span>
            </div>
          )}
        </div>
      </section>
      <section className="site-container capabilities">
        <h2>
          What{' '}
          <strong>
            ResearchHub <span>BNHS</span>
          </strong>{' '}
          Can Do
        </h2>
        <div className="green-rule centered" />
        <div className="feature-grid">
          {features.map(([Icon, title, text]) => (
            <article className="feature-card" key={title}>
              <div className="feature-icon">
                <Icon />
              </div>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="site-container recent-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">EXPLORE OUR REPOSITORY</p>
            <h2>Recently Added Research</h2>
          </div>
          <Link to="/browse">
            View all research <FiArrowRight />
          </Link>
        </div>
        <ResearchPreviewList />
        <div className="repository-note">
          <FiLock />
          <p>
            Public previews offer a first look. Sign in to explore research details with your school
            account.
          </p>
          <Link to="/login">
            Login <FiArrowRight />
          </Link>
        </div>
      </section>
    </>
  );
}
const info = {
  about: [
    'Knowledge, preserved. Discovery, shared.',
    'About ResearchHub BNHS',
    <>
      <p>
        ResearchHub BNHS is the digital repository for research outputs of Barbaza National High
        School. It brings student research, teacher feedback, and approved research discovery into
        one place.
      </p>
      <div className="info-grid">
        {features.map(([Icon, title, text]) => (
          <article key={title}>
            <Icon />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <p>
        Students can submit their work and follow chapter progress. Teachers guide assigned students
        through review. Administrators organize the repository, while researchers explore approved
        research details.
      </p>
    </>
  ],
  guidelines: [
    'A clear path from idea to submission.',
    'Submission Guidelines',
    <>
      <ol className="guideline-list">
        <li>
          <h2>Prepare your research</h2>
          <p>
            Include a title, abstract, authors, keywords, strand, category, and year. Use consistent
            chapter headings, such as “Chapter I — Introduction.”
          </p>
        </li>
        <li>
          <h2>Select your teacher</h2>
          <p>
            Choose from the teachers assigned to you. Contact the school administrator if your
            teacher is missing.
          </p>
        </li>
        <li>
          <h2>Upload and check chapters</h2>
          <p>
            Upload a PDF or DOCX manuscript up to 50 MiB. Review the detected chapter boundaries
            before submitting. Convert older DOC files to DOCX or PDF first. Scanned PDFs need
            manual page ranges.
          </p>
        </li>
        <li>
          <h2>Follow feedback and deadlines</h2>
          <p>
            Read feedback for each chapter, upload revisions, and track due dates in your workspace.
            Completion reflects chapters approved by your teacher.
          </p>
        </li>
        <li>
          <h2>Respect research authorship</h2>
          <p>
            Credit the sources you use and follow your teacher's research and submission
            instructions. The school controls which approved records are available as public
            previews.
          </p>
        </li>
      </ol>
    </>
  ],
  contact: [
    'We are here to help you find your way.',
    'Contact the School',
    <>
      <p>
        For account access, teacher assignments, submission guidance, or repository enquiries,
        contact the school administration or your research teacher.
      </p>
      <div className="contact-card">
        <FiMapPin />
        <div>
          <h2>{site.school}</h2>
          <p>{site.location}</p>
        </div>
      </div>
      {site.email && (
        <a className="contact-card" href={`mailto:${site.email}`}>
          <FiMail />
          <div>
            <h2>Email the school</h2>
            <p>{site.email}</p>
          </div>
        </a>
      )}
    </>
  ]
};
export function InformationPage({ type }) {
  const [intro, title, body] = info[type];
  return (
    <section className="site-container information-page">
      <p className="eyebrow">RESEARCHHUB BNHS</p>
      <h1>{title}</h1>
      <p className="page-intro">{intro}</p>
      <div className="green-rule" />
      <div className="information-body">{body}</div>
    </section>
  );
}
export function BrowsePage() {
  return (
    <section className="site-container information-page">
      <p className="eyebrow">THE SCHOOL RESEARCH COLLECTION</p>
      <h1>Browse Research</h1>
      <p className="page-intro">
        Discover ideas, perspectives, and research from our school community.
      </p>
      <ResearchPreviewList browse />
    </section>
  );
}
