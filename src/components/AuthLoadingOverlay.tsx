import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const authTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#f5a623" },
  },
});

export function AuthLoadingOverlay({ open }: { open: boolean }) {
  return (
    <ThemeProvider theme={authTheme}>
      <Backdrop
        open={open}
        sx={{ zIndex: 2000, backgroundColor: "rgba(0, 0, 0, 0.72)" }}
      >
        <CircularProgress color="primary" size={48} aria-label="Signing in" />
      </Backdrop>
    </ThemeProvider>
  );
}
