const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { MongoClient } = require('mongodb');

(async function () {
  let driver;
  let mongoClient;
  let db;

  // Cấu hình MongoDB
  const DB_CONFIGS = {
    HOST: '127.0.0.1',
    PORT: '27017',
    NAME: 'student_management'
  };
  const uri = `mongodb://${DB_CONFIGS.HOST}:${DB_CONFIGS.PORT}`;

  try {
    // Khởi tạo kết nối MongoDB
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    db = mongoClient.db(DB_CONFIGS.NAME);
    console.log('Connected to MongoDB');

    // Khởi tạo driver
    const chromeOptions = new chrome.Options();
    // chromeOptions.addArguments('--headless');
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    await driver.manage().window().maximize();

    // Test 1: Đăng nhập
    console.log('Navigating to login page...');
    await driver.get('http://localhost:3000/login');
    const usernameField = await driver.wait(until.elementLocated(By.name('username')), 2000);
    await usernameField.sendKeys('19029999'); 
    const passwordField = await driver.wait(until.elementLocated(By.name('password')), 2000);
    await passwordField.sendKeys('bach');
    const loginButton = await driver.wait(until.elementLocated(By.xpath('//button[text()="Đăng nhập"]')), 2000);
    await loginButton.click();
    await driver.wait(until.urlContains('/'), 2000);
    const homeElement = await driver.wait(until.elementLocated(By.xpath('//h3[contains(text(), "Chào mừng")]')), 2000);
    if (!await homeElement.isDisplayed()) {
      throw new Error('Đăng nhập không thành công, không tìm thấy tiêu đề trang chủ');
    }
    console.log('Test 1: Đăng nhập thành công');

    // Test 2: Chọn chức năng Đổi lớp/Chọn lớp
    console.log('Looking for Chọn lớp/Đổi lớp button...');
    const selectClassUrl = await driver.getCurrentUrl();
    console.log('Current URL before selecting class:', selectClassUrl);
    let selectClassCard;
    try {
      const selectClassText = await driver.wait(
        until.elementLocated(By.xpath('//h5[contains(text(), "chọn lớp") or contains(text(), "đổi lớp")]')),
        2000
      );
      selectClassCard = await selectClassText.findElement(By.xpath('ancestor::div[contains(@class, "ant-card")]'));
    } catch (e) {
      console.log('Locator 1 failed, trying alternative locator...');
      selectClassCard = await driver.wait(
        until.elementLocated(By.xpath('//div[contains(@class, "ant-card") and .//span[contains(@class, "anticon-appstore")]]')),
        2000
      );
    }
    if (!selectClassCard.isDisplayed()) {
      throw new Error('Không tìm thấy card Chọn lớp/Đổi lớp');
    }
    await selectClassCard.click();
    console.log('Test 2: Mở chức năng Đổi lớp/Chọn lớp thành công');

    // Test 3: Chọn lớp D21CNPM01
    console.log('Selecting class D21CNPM01...');
    const classOption = await driver.wait(
      until.elementLocated(By.xpath('//div[contains(text(), "D21CNPM01")]')),
      2000
    );
    await classOption.click();
    await driver.wait(until.elementIsVisible(classOption), 2000);
    const currentUrl = await driver.getCurrentUrl();
    console.log('Current URL after selecting class:', currentUrl);
    if (currentUrl.includes('/profile')) {
      console.log('Unexpected redirect to /profile, navigating back to home...');
      await driver.navigate().back();
      await driver.wait(until.urlContains('/'), 2000);
    }
    await driver.wait(until.elementLocated(By.xpath('//div[contains(@class, "ant-card-head-title") and contains(text(), "D21CNPM01")]')), 2000);
    console.log('Test 3: Chọn lớp D21CNPM01 thành công');

    // Test 4: Vào chức năng Diễn đàn
    console.log('Navigating to forum...');
    const currentUrlAfterTest3 = await driver.getCurrentUrl();
    console.log('Current URL before navigating to forum:', currentUrlAfterTest3);
    const classId = 'fe03cf8d-ad21-41fe-801f-62a0929bef13';
    let forumLink;
    try {
      forumLink = await driver.wait(
        until.elementLocated(By.xpath('//a[.//text()[contains(translate(., "DIỄNDÀN", "diễndàn"), "diễn đàn")]]')),
        2000
      );
      if (!await forumLink.isDisplayed()) {
        throw new Error('Liên kết Diễn đàn không hiển thị');
      }
      await forumLink.click();
    } catch (e) {
      console.log('Không tìm thấy liên kết Diễn đàn, điều hướng trực tiếp...');
      await driver.get(`http://localhost:3000/${classId}/feed`);
    }
    await driver.wait(until.urlContains(`/${classId}/feed`), 2000);
    let feedPageLoaded = false;
    try {
      await driver.wait(
        until.elementLocated(By.xpath('//h1[contains(text(), "Hiện chưa có bài đăng nào cả")]')),
        2000
      );
      feedPageLoaded = true;
    } catch (e) {
      console.log('Không tìm thấy thông báo "Hiện chưa có bài đăng nào cả", thử kiểm tra bài đăng...');
      try {
        await driver.wait(
          until.elementLocated(By.xpath('//div[contains(@style, "padding-right: 300px") and contains(@style, "padding-left: 230px")]')),
          2000
        );
        feedPageLoaded = true;
      } catch (e2) {
        console.log('Không tìm thấy div bài đăng, thử tìm nút tạo bài đăng mới...');
        await driver.wait(
          until.elementLocated(By.xpath('//button[contains(text(), "Đăng bài mới")]')),
          2000
        );
        feedPageLoaded = true;
      }
    }
    if (!feedPageLoaded) {
      throw new Error('Không thể xác nhận trang diễn đàn đã hiển thị');
    }
    console.log('Test 4: Vào chức năng Diễn đàn thành công');

    // Test 5: Đăng bài mới
    console.log('Creating a new post...');
    let newPostButton;
    try {
      newPostButton = await driver.wait(
        until.elementLocated(By.xpath('//button[contains(text(), "Đăng bài mới")]')),
        2000
      );
      if (!await newPostButton.isDisplayed()) {
        throw new Error('Nút Đăng bài mới không hiển thị');
      }
      await newPostButton.click();
    } catch (e) {
      console.log('XPath failed, trying CSS selector...');
      newPostButton = await driver.wait(
        until.elementLocated(By.css('button.MuiButton-containedPrimary')),
        2000
      );
      if (!await newPostButton.isDisplayed()) {
        throw new Error('Nút Đăng bài mới không hiển thị qua CSS selector');
      }
      await newPostButton.click();
    }

    let postContentInput;
    try {
      postContentInput = await driver.wait(
        until.elementLocated(By.xpath('//textarea[contains(@placeholder, "Viết nội dung") or contains(@placeholder, "Nhập nội dung bài đăng")]')),
        2000
      );
      await postContentInput.clear();
      await postContentInput.sendKeys('Selenium xin chào');
    } catch (e) {
      throw new Error('Không tìm thấy ô nhập nội dung bài đăng: ' + e.message);
    }

    let submitPostButton;
    try {
      submitPostButton = await driver.wait(
        until.elementLocated(By.xpath('//button[contains(text(), "Đăng")]')),
        2000
      );
      if (!await submitPostButton.isDisplayed()) {
        throw new Error('Nút Đăng không hiển thị');
      }
      await submitPostButton.click();
    } catch (e) {
      console.log('XPath failed, trying CSS selector...');
      submitPostButton = await driver.wait(
        until.elementLocated(By.css('button.MuiLoadingButton-root.MuiButton-containedPrimary')),
        2000
      );
      if (!await submitPostButton.isDisplayed()) {
        throw new Error('Nút Đăng không hiển thị qua CSS selector');
      }
      await submitPostButton.click();
    }

    // Kiểm tra bài đăng mới
    let newPost;
    try {
      newPost = await driver.wait(
        until.elementLocated(By.xpath('//*[contains(text(), "Selenium xin chào")]')),
        3000
      );
      if (!await newPost.isDisplayed()) {
        throw new Error('Bài đăng "Selenium xin chào" không hiển thị');
      }
    } catch (e) {
      console.log('XPath failed, debugging DOM...');
      const feedArea = await driver.findElement(By.xpath('//body'));
      const feedHtml = await feedArea.getAttribute('innerHTML');
      console.log('Feed area HTML:', feedHtml.substring(0, 500));
      throw new Error('Không tìm thấy bài đăng với nội dung "Selenium xin chào": ' + e.message);
    }

    console.log('Test 5: Đăng bài mới thành công');
    // Chờ 5 giây để hiển thị danh sách bài đăng
    console.log('Waiting 5 seconds to view the post list...');
    await driver.sleep(5000);

    // Debug: In tất cả document trong collection posts
    console.log('Debugging MongoDB collection posts...');
    try {
      const posts = await db.collection('posts').find({}).toArray();
      console.log('Documents in posts collection:', JSON.stringify(posts, null, 2));
    } catch (e) {
      console.error('Failed to fetch documents from MongoDB:', e.message);
    }

    // Rollback DB: Xóa bài đăng dựa trên nội dung
    console.log('Deleting post from MongoDB...');
    try {
      const result = await db.collection('posts').deleteOne({ content: 'Selenium xin chào' });
      if (result.deletedCount === 1) {
        console.log('Post deleted successfully from MongoDB');
      } else {
        console.warn('No post found with content "Selenium xin chào"');
      }
    } catch (e) {
      console.error('Failed to delete post from MongoDB:', e.message);
      throw new Error('Không thể xóa bài đăng từ DB');
    }

  } catch (error) {
    console.error('Lỗi:', error.message);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('MongoDB connection closed');
    }
    if (driver) {
      await driver.quit();
      console.log('Browser closed');
    }
  }
})();