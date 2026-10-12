package dev.creditlab.assistant;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
class AppGuideToolsTest {
  @Test void explainsActualStudioAndLocaleLinks(){var tools=new AppGuideTools("vi");assertThat(tools.appFeature("studio")).contains("Qdrant","/vi#studio","Tìm chứng cứ");assertThat(tools.appFeatures()).contains("/vi#audit","/vi#documents");}
  @Test void unknownSectionCannotBecomeArbitraryLink(){assertThat(new AppGuideTools("en").appFeature("https://evil.example")).isEqualTo("Unknown section. Use appFeatures to list actual sections.");}
  @Test void allLocalesExplicitlyDistinguishPublicFixtures(){assertThat(new AppGuideTools("de").appFeature("studio")).contains("Öffentliche Demo");assertThat(new AppGuideTools("en").appFeature("documents")).contains("DATEV","Confirm before uploading");}
}
