package tw.advanceddb.medical.scripts;

import tw.advanceddb.medical.config.Neo4jConnection;
import tw.advanceddb.medical.config.ProjectFiles;
import tw.advanceddb.medical.repository.FacilityImportRepository;
import tw.advanceddb.medical.service.FacilityImportService;

public final class ImportMedicalFacilities {
    public static void main(String[] args) {
        try {
            var backend = ProjectFiles.backend();
            var source = backend.getParent().resolve("data/medicalFacilities.json");
            System.out.println("讀取資料：" + source);
            var plan = new FacilityImportService().inspect(source);
            System.out.printf("院所 %d 筆；科別 %d 種；科別關係 %d 筆；錯誤 %d 筆%n",
                    plan.sourceCount(), plan.departmentCount(), plan.relationshipCount(), plan.errorCount());
            if (!plan.valid()) {
                plan.errors().forEach(System.err::println);
                throw new IllegalArgumentException("資料檢查未通過，尚未寫入 Neo4j。");
            }
            System.out.println("開始寫入 Neo4j 資料庫：" + Neo4jConnection.DATABASE);
            try (var driver = Neo4jConnection.open(backend)) {
                driver.verifyConnectivity();
                new FacilityImportRepository(driver).write(plan.rows(),
                        count -> System.out.printf("已寫入 %d / %d 筆%n", count, plan.rows().size()));
            }
            System.out.println("院所與科別匯入完成。");
        } catch (IllegalArgumentException | IllegalStateException exception) {
            System.err.println(exception.getMessage());
            System.exit(1);
        } catch (io.github.cdimascio.dotenv.DotenvException exception) {
            System.err.println("無法讀取 backend/.env，請檢查 KEY=value 格式。");
            System.exit(1);
        } catch (java.io.IOException exception) {
            System.err.println("無法讀取 data/medicalFacilities.json，請檢查檔案與 JSON 格式。");
            System.exit(1);
        } catch (Exception exception) {
            System.err.println("匯入失敗（" + exception.getClass().getSimpleName()
                    + "），請檢查 Neo4j 是否啟動、帳密及資料庫權限。先前成功批次可重跑。");
            System.exit(1);
        }
    }
}
