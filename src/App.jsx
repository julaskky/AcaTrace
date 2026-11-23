import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import StudentMyDocuments from "./pages/student/MyDocuments";
import StudentThesisDefense from "./pages/student/ThesisDefense";
import StudentNotifications from "./pages/student/Notifications";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import SupervisedResearch from "./pages/supervisor/SupervisedResearch";
import SupervisorMilestones from "./pages/supervisor/SupervisorMilestones";
import SupervisorMeetings from "./pages/supervisor/SupervisorMeetings";
import SupervisorTasks from "./pages/supervisor/SupervisorTasks";
import SupervisorProgress from "./pages/supervisor/SupervisorProgress";
import SupervisorDocumentReviews from "./pages/supervisor/SupervisorDocumentReviews";
import SupervisorThesisDefense from "./pages/supervisor/SupervisorThesisDefense";
import SupervisorNotifications from "./pages/supervisor/SupervisorNotifications";
import SupervisorProfile from "./pages/supervisor/SupervisorProfile";






// Shared pages
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";

// Student pages
import StudentDashboard from "./pages/student/Dashboard";
import StudentProfile from "./pages/student/Profile";
import StudentResearchProjects from "./pages/student/ResearchProjects";
import StudentMilestones from "./pages/student/Milestones";
import StudentMeetings from "./pages/student/Meetings";
import StudentTasks from "./pages/student/Tasks";
import StudentMyProgress from "./pages/student/MyProgress";

// Administrator pages
import InstitutionManagement from "./pages/administrator/InstitutionManagement";
import DepartmentManagement from "./pages/administrator/DepartmentManagement";
import SupervisorManagement from "./pages/administrator/SupervisorManagement";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Shared routes */}
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* Student routes */}
        <Route
          path="/student/dashboard"
          element={<StudentDashboard />}
        />
        <Route path="/student/profile" element={<StudentProfile />} />
        <Route
          path="/student/research"
          element={<StudentResearchProjects />}
        />
        <Route path="/student/milestones" element={<StudentMilestones />} />
        <Route path="/student/meetings" element={<StudentMeetings />} />
        <Route path="/student/tasks" element={<StudentTasks />} />
        <Route
          path="/student/my-progress"
          element={<StudentMyProgress />}
        />

        {/* New student features */}
        
	<Route
  		path="/student/research-documents"
  		element={<StudentMyDocuments />}
	/>

        <Route
  		path="/student/thesis-defense"
  		element={<StudentThesisDefense />}
	/>


        <Route
  		path="/student/notifications"
  		element={<StudentNotifications />}
	/>

        {/* Supervisor routes */}
	<Route path="/supervisor/dashboard" element={<SupervisorDashboard />}/>
	<Route path="/supervisor/research" element={<SupervisedResearch />} />
	<Route path="/supervisor/milestones" element={<SupervisorMilestones />}/>
	<Route path="/supervisor/meetings" element={<SupervisorMeetings />}/>
	<Route path="/supervisor/tasks" element={<SupervisorTasks />}/>
	<Route path="/supervisor/progress" element={<SupervisorProgress />}/>
	<Route path="/supervisor/documents" element={<SupervisorDocumentReviews />}/>
	<Route path="/supervisor/thesis-defense" element={<SupervisorThesisDefense />}/>
	<Route path="/supervisor/notifications" element={<SupervisorNotifications />}/>
	<Route path="/supervisor/profile" element={<SupervisorProfile />}/>







	{/* Administrator routes */}
        <Route
          path="/administrator/institutions"
          element={<InstitutionManagement />}
        />
        <Route
          path="/administrator/departments"
          element={<DepartmentManagement />}
        />
        <Route
          path="/administrator/supervisors"
          element={<SupervisorManagement />}
        />

        {/* Temporary compatibility redirects */}
        <Route
          path="/dashboard"
          element={<Navigate to="/student/dashboard" replace />}
        />
        <Route
          path="/profile"
          element={<Navigate to="/student/profile" replace />}
        />

        {/* Unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;