package tw.advanceddb.medical.service;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class FacilityTypeClassifierTest {
    @Test void allKnownFacilityTypesHaveExplicitClassification() {
        assertThat(FacilityTypeClassifier.HOSPITALS).hasSize(4);
        assertThat(FacilityTypeClassifier.CLINICS).hasSize(10);
        for (String type : FacilityTypeClassifier.HOSPITALS) {
            assertThat(FacilityTypeClassifier.classify(type)).isEqualTo("hospital");
        }
        for (String type : FacilityTypeClassifier.CLINICS) {
            assertThat(FacilityTypeClassifier.classify(type)).isEqualTo("clinic");
        }
        assertThat(FacilityTypeClassifier.classify("病理中心")).isEqualTo("other");
        assertThat(FacilityTypeClassifier.classify("名稱含診所但非已知分類")).isEqualTo("other");
    }
}
