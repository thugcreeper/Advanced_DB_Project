package tw.advanceddb.medical.service;

import java.util.List;

public final class FacilityTypeClassifier {
    public static final List<String> HOSPITALS=List.of("醫院","綜合醫院","精神科醫院","中醫醫院");
    public static final List<String> CLINICS=List.of("一般診所(醫務室)","中醫一般診所","中醫專科診所","中醫診所","牙醫一般診所","牙醫專科診所","牙醫診所","西醫診所","西醫診所(醫務室)","專科診所");
    private FacilityTypeClassifier() {}
    public static String classify(String type) {
        if (HOSPITALS.contains(type)) return "hospital";
        if (CLINICS.contains(type)) return "clinic";
        return "other";
    }
}
