package tw.advanceddb.medical.config;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class LocalWebConfig implements WebMvcConfigurer {
    private final String[] origins;
    public LocalWebConfig(@Value("${app.cors.allowed-origins:}") String configured) {
        origins = Arrays.stream(configured.split(",")).map(String::strip).filter(s -> !s.isEmpty()).toArray(String[]::new);
        for (String origin : origins) {
            if (origin.contains("*") || !origin.matches("https?://[^/]+"))
                throw new IllegalArgumentException("CORS_ALLOWED_ORIGINS 必須是明確的 HTTP(S) 來源。");
        }
    }
    @Override public void addCorsMappings(CorsRegistry registry) {
        if (origins.length > 0) registry.addMapping("/api/**").allowedOrigins(origins)
                .allowedMethods("GET", "POST").allowedHeaders("Accept", "Content-Type").allowCredentials(false).maxAge(600);
    }
}
