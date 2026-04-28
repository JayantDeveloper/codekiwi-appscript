const BACKEND_URL = "https://codekiwi-app-backend.onrender.com/api/sessions/upload";
const TEACHER_VIEW_BASE_URL = "https://www.codekiwi.app/teacher/";
const CODING_SLIDE_MARKER = "Code Question:";

function onOpen(e) {
  SlidesApp.getUi()
    .createAddonMenu()
    .addItem('Open CodeKiwi Controls', 'openSidebar')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('CodeKiwi Controls');
  SlidesApp.getUi().showSidebar(html);
}

function openEmptyQuestionDialog() {
  const html = HtmlService.createHtmlOutputFromFile('QuestionDialog')
    .setWidth(350)
    .setHeight(150);
  SlidesApp.getUi().showModalDialog(html, 'Add Code Question Marker');
}

function addInteractiveSlideMarker() {
  const presentation = SlidesApp.getActivePresentation();
  const selection = presentation.getSelection();
  const currentPage = selection.getCurrentPage();
  if (!currentPage || currentPage.getPageType() !== SlidesApp.PageType.SLIDE) return;

  const slide = currentPage.asSlide();
  const notesPage = slide.getNotesPage();
  const speakerNotesShape = notesPage.getSpeakerNotesShape();

  if (!speakerNotesShape) {
    notesPage.getPlaceholder(SlidesApp.PlaceholderType.BODY)
      .asShape().getText().setText(CODING_SLIDE_MARKER + "\nPrompt: [Enter your question prompt here]");
  } else {
    const notes = speakerNotesShape.getText().asString();
    if (!notes.startsWith(CODING_SLIDE_MARKER)) {
      speakerNotesShape.getText().insertText(0, CODING_SLIDE_MARKER + "\nPrompt: [Enter your question prompt here]\n\n");
    } else {
      SlidesApp.getUi().alert("This slide is already marked as a coding question.");
      return;
    }
  }

  SlidesApp.getUi().alert("Coding question marker added to speaker notes.");
}

function initiateLessonSession() {
  const presentation = SlidesApp.getActivePresentation();
  const presentationTitle = presentation.getName();
  const presentationId = presentation.getId();

  const file = DriveApp.getFileById(presentationId);
  const fileBase64 = Utilities.base64Encode(file.getAs('application/pdf').getBytes());

  const notesArray = presentation.getSlides().map(function(slide) {
    const shape = slide.getNotesPage().getSpeakerNotesShape();
    return shape ? shape.getText().asString().trim() : "";
  });

  const slidesUrl = "https://docs.google.com/presentation/d/" + presentationId + "/edit";
  const secret = PropertiesService.getScriptProperties().getProperty('APPSCRIPT_SECRET') || '';

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      presentationId: presentationId,
      title: presentationTitle,
      notes: notesArray,
      slidesUrl: slidesUrl,
      fileBase64: fileBase64,
    }),
    headers: {
      'x-codekiwi-secret': secret,
    },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(BACKEND_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 201) {
      const jsonResponse = JSON.parse(responseBody);
      if (jsonResponse.success && jsonResponse.sessionCode) {
        return TEACHER_VIEW_BASE_URL + jsonResponse.sessionCode;
      }
      throw new Error("Unexpected response: " + responseBody);
    }
    throw new Error("Backend error (" + responseCode + "): " + responseBody);
  } catch (err) {
    console.error("initiateLessonSession error:", err);
    throw new Error("Failed to start lesson session. " + err.message);
  }
}
