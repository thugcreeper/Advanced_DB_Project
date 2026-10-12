package tw.advanceddb.medical.config;

import java.nio.file.Files;
import java.nio.file.Path;

public final class ProjectFiles {
    private ProjectFiles() {}
    public static Path backend() {
        try {
            Path compiled = Path.of(ProjectFiles.class.getProtectionDomain().getCodeSource().getLocation().toURI());
            for (Path start : new Path[]{Path.of("").toAbsolutePath(), compiled}) {
                for (Path directory = start; directory != null; directory = directory.getParent()) {
                    Path candidate = "backend".equals(directory.getFileName() == null ? "" : directory.getFileName().toString())
                            ? directory : directory.resolve("backend");
                    if (Files.isRegularFile(candidate.resolve("pom.xml")) && Files.isDirectory(candidate.getParent().resolve("data")))
                        return candidate.toAbsolutePath().normalize();
                }
            }
        } catch (java.net.URISyntaxException exception) {
            throw new IllegalStateException("無法定位專案資料夾。", exception);
        }
        throw new IllegalStateException("找不到專案，請在 Advanced_DB_Project 專案中啟動。");
    }
}
