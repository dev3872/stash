import { Navigate, useLocation, useParams } from 'react-router';

/** Old /sequences/:id links now open the lesson player. */
export function SequencePage() {
  const { id } = useParams();
  const location = useLocation();
  return <Navigate to={`/learn/${id}${location.search}`} replace state={location.state} />;
}
